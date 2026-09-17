import type { ReactNode } from 'react';
import type { TableSort } from '../table-sort.js';

export function SortableTableHeader<K extends PropertyKey>({
  column,
  sort,
  onSort,
  children,
  className,
  title,
  after,
}: {
  column: K;
  sort: TableSort<K>;
  onSort: (next: TableSort<K>) => void;
  children: ReactNode;
  className?: string;
  title?: string;
  after?: ReactNode;
}) {
  const active = sort?.column === column;
  return (
    <th
      scope="col"
      className={className}
      title={title}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        data-native-control="sort"
        type="button"
        className="th-sort"
        onClick={() =>
          onSort(
            !sort || sort.column !== column
              ? { column, dir: 'asc' }
              : sort.dir === 'asc'
                ? { column, dir: 'desc' }
                : null,
          )
        }
      >
        {children}
      </button>
      {after}
    </th>
  );
}
