/** Render story text as plain text, never injected HTML. */
export function renderScene(scene, onChoice, options = {}) {
  document.querySelector('#scene-title').textContent = scene.title;
  document.querySelector('#scene-label').textContent = scene.chapter;
  document.querySelector('#story-text').textContent = scene.text;
  document.querySelector('#error').hidden = true;
  const container = document.querySelector('#choices');
  container.replaceChildren();
  for (const [index, choice] of (scene.choices ?? []).entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.textContent = choice.text;
    button.disabled = !!options.disabled;
    button.addEventListener('click', () => onChoice(options.choiceIndex ? index : choice.next));
    container.appendChild(button);
  }
}
export function showError(message) {
  const error = document.querySelector('#error');
  error.textContent = message instanceof Error ? message.message : String(message);
  error.hidden = false;
}
