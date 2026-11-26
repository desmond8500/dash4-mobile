/** Taille du bouton « Haut de page » et écart avec le bouton rond d'ajout. */
export const SCROLL_TOP_SIZE = 40
export const FAB_GAP = 12

/**
 * Position du bouton « Haut de page » juste à gauche du bouton rond d'ajout, centré verticalement sur lui
 * (coordonnées `right` / `bottom` d'un élément en position fixe).
 */
export function besideFab(
  fab: Pick<DOMRect, 'left' | 'top' | 'height'>,
  viewportWidth: number,
  viewportHeight: number,
): { right: string; bottom: string } {
  const right = viewportWidth - fab.left + FAB_GAP
  const centerY = fab.top + fab.height / 2
  const bottom = viewportHeight - centerY - SCROLL_TOP_SIZE / 2
  return { right: `${Math.round(right)}px`, bottom: `${Math.round(bottom)}px` }
}
