/** Keeps hyphenated words like «AI-тренер» on one line inside balanced headings. */
export function NoBreak({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\S+-\S+)/).map((part, i) =>
        i % 2 ? (
          <span key={i} style={{ whiteSpace: 'nowrap' }}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
