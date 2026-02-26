import React, { memo, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

interface Props {
  html: string;
  darkMode?: boolean;
}

const DescriptionHTML = memo(function DescriptionHTML({ html, darkMode }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !html) return;
    // Sanitizar el HTML antes de insertarlo para prevenir XSS
    ref.current.innerHTML = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
                     'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'span', 'div',
                     'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
    });
    ref.current.querySelectorAll('img').forEach(img => {
      img.onerror = () => { img.style.display = 'none'; };
    });
  }, [html]);

  return (
    <div
      ref={ref}
      className={`prose prose-sm max-w-none ${darkMode ? 'prose-invert [&_*:not(a)]:!text-gray-200' : ''} [&_img]:rounded-lg [&_img]:max-w-full [&_a]:!text-purple-400`}
    />
  );
});

export default DescriptionHTML;
