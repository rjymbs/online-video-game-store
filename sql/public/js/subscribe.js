const form = document.getElementById('subscribeForm');
const emailInput = document.getElementById('emailInput');
const subscribeButton = document.getElementById('subscribeButton');
const subscribeMessage = document.getElementById('subscribeMessage');

emailInput.addEventListener('input', () => {
  const email = emailInput.value.trim();
  subscribeButton.disabled = !isValidEmail(email);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();

  // Проверка корректности email
  if (!isValidEmail(email)) {
    subscribeMessage.innerHTML = 'Пожалуйста, введите корректный email.';
    subscribeMessage.classList.add('text-danger');
    subscribeMessage.classList.remove('text-success');
    return;
  }

  // Имитация отправки данных на сервер
  subscribeMessage.innerHTML = `Спасибо, ${email} успешно подписан!`;
  subscribeMessage.classList.add('text-success');
  subscribeMessage.classList.remove('text-danger');

  // Очистка поля ввода
  emailInput.value = '';
  subscribeButton.disabled = true;
});

function isValidEmail(email) {
  // Простая проверка формата email
  return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email);
}