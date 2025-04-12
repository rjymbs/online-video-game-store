const callbackLink = document.querySelector('.callback');
const modal = document.getElementById('modal');
const closeButton = document.getElementsByClassName('close-button')[0];

callbackLink.onclick = function () {
    modal.style.display = 'block';
};

closeButton.onclick = function () {
    modal.style.display = 'none';
};

window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = 'none';
    }
};