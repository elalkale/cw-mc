import React, { memo, useRef, useEffect } from 'react';

const DescriptionHTML = memo(function DescriptionHTML({ html, darkMode }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !html) return;
    ref.current.innerHTML = html;
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
