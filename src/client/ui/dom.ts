export const SHIP_COLORS: Record<string, string> = {
    red: '#ed8270',
    blue: '#7fbddd',
    green: '#9ac998',
    yellow: '#e9c979',
    white: '#e8e5d7',
    black: '#a4a5b8',
};

export function escapeHtml(value: string): string {
    return value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[character]!,
    );
}

export function shipIcon(color: string, className = ''): string {
    return `<span aria-hidden="true" class="ship-icon ${className}" style="background-image:url('assets/ships/ship-${color}-race-states.png')"></span>`;
}

export function replaceContent(element: HTMLElement, html: string) {
    if (element.innerHTML === html) return;
    const focused = element.contains(document.activeElement)
        ? (document.activeElement as HTMLElement)
        : null;
    const action = focused?.dataset.action;
    const value = focused?.dataset.value;
    element.innerHTML = html;
    if (action) {
        const replacement = Array.from(
            element.querySelectorAll<HTMLElement>('[data-action]'),
        ).find(
            (candidate) =>
                candidate.dataset.action === action &&
                candidate.dataset.value === value,
        );
        replacement?.focus({ preventScroll: true });
    }
}

export const COMPASS = `<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="43" stroke="currentColor" stroke-width="1"/><circle cx="50" cy="50" r="33" stroke="currentColor" stroke-width=".5"/><path d="M50 4 59 41 96 50 59 59 50 96 41 59 4 50 41 41Z" stroke="currentColor"/><path d="M50 4 50 50 41 41Z M96 50 50 50 59 41Z M50 96 50 50 59 59Z M4 50 50 50 41 59Z" fill="currentColor"/><circle cx="50" cy="50" r="4" fill="currentColor"/></svg>`;
