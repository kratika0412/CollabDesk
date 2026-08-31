import type { ActiveUser } from '../types';

type Props = {
  users: ActiveUser[];
  currentUserId: string;
  createdById: string;
  onRemoveMember?: (userId: string, name: string) => void;
};

export function ActiveUsers({
  users,
  currentUserId,
  createdById,
  onRemoveMember,
}: Props) {
  const isCreator = createdById === currentUserId;

  return (
    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
        <span>Active</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
          {users.length}
        </span>
      </div>
      <ul className="space-y-1 text-xs">
        {users.length === 0 && <li className="text-slate-500">No one online yet.</li>}
        {users.map((u) => (
          <li
            key={u.userId}
            className="flex items-center justify-between gap-2 text-slate-100"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="truncate">{u.name}</span>
            </span>
            {isCreator &&
              onRemoveMember &&
              u.userId !== currentUserId &&
              u.userId !== createdById && (
              <button
                type="button"
                title="Remove from workspace"
                onClick={() => onRemoveMember(u.userId, u.name)}
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-red-500/20 hover:text-red-300"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
