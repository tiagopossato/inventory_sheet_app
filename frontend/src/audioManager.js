/**
 * @fileoverview AudioManager - Módulo de Gerenciamento de Feedback Sonoro e Tátil
 * 
 * Gerencia feedback sonoro (Web Audio API) e tátil (vibração) para a aplicação.
 * Implementa padrão Singleton com perfis pré-definidos para diferentes tipos de notificação.
 * 
 * @module AudioManager
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * @typedef {Object} AudioProfile
 * @property {number} repeat - Número de repetições do som
 * @property {number} duration - Duração de cada tom em segundos
 * @property {number} freq - Frequência do som em Hz
 * @property {number[]} [vibrate] - Padrão de vibração em milissegundos (opcional)
 */

/**
 * @typedef {Object} AudioManagerTypes
 * @property {AudioProfile} SUCCESS - Perfil para feedback de sucesso
 * @property {AudioProfile} WARNING - Perfil para feedback de alerta
 * @property {AudioProfile} ERROR - Perfil para feedback de erro
 */

/**
 * Classe principal do módulo AudioManager
 * @class
 * @public
 */
function AudioManager() {
    /**
     * Contexto de áudio Web Audio API
     * @type {AudioContext|null}
     * @private
     */
    this.audioContext = null;

    /**
     * Definição de perfis sonoros e padrões de vibração
     * Vibrate: [ms vibrando, ms silêncio, ms vibrando...]
     * @type {AudioManagerTypes}
     * @public
     */
    this.TYPES = {
        SUCCESS: { repeat: 1, duration: 0.1, freq: 880 },
        WARNING: { repeat: 2, duration: 0.2, freq: 555, vibrate: [200, 300, 200] },
        ERROR: { repeat: 2, duration: 0.15, freq: 1333, vibrate: [300, 200, 300] }
    };

    // Binds de contexto
    this.init = this.init.bind(this);
    this.play = this.play.bind(this);
    this.vibrate = this.vibrate.bind(this);
    this.playSuccess = this.playSuccess.bind(this);
    this.playWarning = this.playWarning.bind(this);
    this.playError = this.playError.bind(this);

    this.init();
}

/**
 * Inicializa o contexto de áudio Web Audio API
 * @public
 */
AudioManager.prototype.init = function () {
    if (this.audioContext) return;

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            this.audioContext = new AudioContextClass();
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(error => {
                    console.error('Failed to resume AudioContext: ', error);
                });
            }
        }
    } catch (error) {
        console.error("Erro ao inicializar AudioContext:", error);
    }
};

/**
 * Aciona o motor de vibração do dispositivo
 * @param {number[]} pattern - Padrão de vibração em milissegundos
 * @public
 */
AudioManager.prototype.vibrate = function (pattern) {
    if ("vibrate" in navigator) {
        navigator.vibrate(pattern);
    }
};

/**
 * Toca um sinal sonoro e opcionalmente vibra
 * @param {number} [repeat=1] - Número de repetições do som
 * @param {number} [duration=0.1] - Duração de cada tom em segundos
 * @param {number} [frequency=440] - Frequência do som em Hz
 * @param {number[]} [vibratePattern] - Padrão de vibração opcional
 * @public
 */
AudioManager.prototype.play = function (repeat, duration, frequency, vibratePattern) {
    repeat = repeat || 1;
    duration = duration || 0.1;
    frequency = frequency || 440;

    // Executa vibração se houver padrão definido
    if (vibratePattern && !Array.isArray(vibratePattern)) {
        console.warn('vibratePattern inválido: deve ser um Array. Ignorando vibração.');
        vibratePattern = null;
    }

    if (vibratePattern) {
        this.vibrate(vibratePattern);
    }

    if (!this.audioContext) {
        this.init();
        if (!this.audioContext) return;
    }

    if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
    }

    const startTime = this.audioContext.currentTime + 0.05;
    const gap = 0.1;

    try {
        for (let i = 0; i < repeat; i++) {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            const scheduledStart = startTime + (i * (duration + gap));
            const scheduledEnd = scheduledStart + duration;

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, scheduledStart);

            gainNode.gain.cancelScheduledValues(scheduledStart);
            gainNode.gain.setValueAtTime(0, scheduledStart);
            gainNode.gain.linearRampToValueAtTime(0.5, scheduledStart + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, scheduledEnd);

            oscillator.start(scheduledStart);
            oscillator.stop(scheduledEnd);
        }
    } catch (error) {
        console.error('Error playing beep: ', error);
    }
};

/**
 * Atalho para feedback de sucesso (som + vibração)
 * @public
 */
AudioManager.prototype.playSuccess = function () {
    const config = this.TYPES.SUCCESS;
    this.play(config.repeat, config.duration, config.freq, config.vibrate);
};

/**
 * Atalho para feedback de alerta (som + vibração)
 * @public
 */
AudioManager.prototype.playWarning = function () {
    const config = this.TYPES.WARNING;
    this.play(config.repeat, config.duration, config.freq, config.vibrate);
};

/**
 * Atalho para feedback de erro (som + vibração)
 * @public
 */
AudioManager.prototype.playError = function () {
    const config = this.TYPES.ERROR;
    this.play(config.repeat, config.duration, config.freq, config.vibrate);
};

/**
 * Instância singleton do AudioManager
 * @type {AudioManager}
 */
export const audioManager = new AudioManager();
