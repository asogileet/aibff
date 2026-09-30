export class HeartWidget {
  constructor(container, onRecall) {
    this.container = container;
    this.onRecall = onRecall;
    this.element = null;

    this._render();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'restingHeartWidget';
    this.element.className = 'hidden absolute bottom-6 right-6 flex flex-col items-center cursor-pointer group z-50';

    this.element.innerHTML = `
      <div class="relative w-16 h-16 flex items-center justify-center animate-heart-pulse">
        <svg class="w-14 h-14 text-pink-500 fill-current drop-shadow-[0_0_16px_rgba(244,63,94,0.85)] transition-transform group-hover:scale-125" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </div>
      <span class="mt-2 text-xs font-medium text-pink-300 bg-slate-950/80 px-2.5 py-1 rounded-full border border-pink-500/40 shadow-lg group-hover:border-pink-400">點擊或說「回來」召回 💕</span>
    `;

    this.container.appendChild(this.element);

    this.element.addEventListener('click', () => {
      if (typeof this.onRecall === 'function') {
        this.onRecall();
      }
    });
  }

  show() {
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
  }
}
