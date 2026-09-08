// Keeps native date inputs for validation and calendar support while presenting
// selected values in the readable business format: Jan 1, 2026.
(function initDateDisplays() {
    function formatDate(value) {
        if (!value) return 'Select date';

        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime())
            ? 'Select date'
            : new Intl.DateTimeFormat('en-PH', {
                month: 'short', day: 'numeric', year: 'numeric'
            }).format(date);
    }

    function enhanceDateInput(input) {
        if (input.dataset.dateDisplayReady) return;

        input.dataset.dateDisplayReady = 'true';
        input.classList.add('native-date-control');

        const wrapper = document.createElement('span');
        wrapper.className = 'date-display-control';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const display = document.createElement('span');
        display.className = 'date-display-value';
        display.setAttribute('aria-hidden', 'true');
        wrapper.appendChild(display);

        const updateDisplay = () => {
            display.textContent = formatDate(input.value);
            wrapper.classList.toggle('has-value', Boolean(input.value));
        };

        input.addEventListener('input', updateDisplay);
        input.addEventListener('change', updateDisplay);
        updateDisplay();
    }

    function init() {
        document.querySelectorAll('input[type="date"]').forEach(enhanceDateInput);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
