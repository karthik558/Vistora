export function TableLoadingRows({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className="table-loading-row" aria-hidden={row > 0 ? true : undefined}>
          {Array.from({ length: columns }, (_, column) => (
            <td key={column}>
              {row === 0 && column === 0 ? <span className="sr-only">Loading records</span> : null}
              <span className={`table-loading-bar${column % 3 === 1 ? " short" : ""}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
