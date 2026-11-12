// Title screen logo image.
const logo = new Image();
logo.src = new URL('../../textures/title-logo.png', import.meta.url);
export function getLogo() { return logo; }
