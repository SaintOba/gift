
const pinInput = document.getElementById('pinInput');
const keypadButtons = document.querySelectorAll('.keypad-button');
let currentPin = '';

keypadButtons.forEach(button =>{
    button.addEventListener('click', () => {
        const value = button.dataset.value;

        if (value === 'del') {
            currentPin = currentPin.slice(0, -1);
        }else if (value === 'ok') {
            if(currentPin === '3036') {
               window.location.href='login.html';
                currentPin = '';
            } else {
                alert('Incorrect Pin.');
            }
        } else{
            currentPin += value;
        }
        pinInput.value = currentPin;
    });
});