/**
 * Page numbers for a numbered pagination: first, last and neighbours of the current page,
 * with 'ellipsis' markers for gaps.
 * @param {number} current
 * @param {number} total
 * @returns {(number|'ellipsis')[]}
 */
export const getPageNumbers = (current, total) => {
  const delta = 1;
  const pages = [];
  for (let i = 1; i <= total; i += 1) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      pages.push(i);
    }
  }

  const withEllipses = [];
  let previous;
  pages.forEach((i) => {
    if (previous !== undefined && i - previous > 1) {
      withEllipses.push('ellipsis');
    }
    withEllipses.push(i);
    previous = i;
  });
  return withEllipses;
};

export default getPageNumbers;
