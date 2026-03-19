(function () {
    var buffer = "";
    var lastKeyTime = Date.now();

    window.addEventListener('keydown', function (e) {
        var currentTime = Date.now();

        // Se o intervalo entre teclas for maior que 50ms, 
        // provavelmente é um humano digitando, então limpamos o buffer.
        if (currentTime - lastKeyTime > 50) {
            buffer = "";
        }

        // Ignora teclas de controle (Shift, Alt, etc)
        if (e.key.length > 1 && e.key !== 'Enter') return;

        if (e.key === 'Enter') {
            if (buffer.length > 2) { // Evita disparar com um Enter acidental              
                // Dispara o seu evento personalizado que já está configurado
                window.dispatchEvent(new CustomEvent('codeScanned', {
                    detail: {
                        code: buffer,
                        source: 'otg'
                    }
                }));
                buffer = ""; // Limpa para a próxima leitura
            }
        } else {
            buffer += e.key;
        }

        lastKeyTime = currentTime;
    });
})();
