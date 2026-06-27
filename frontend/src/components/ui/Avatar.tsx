import { getInitials } from '../../lib/utils';

interface AvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  online?: boolean;
}

const sizeClasses = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

export function Avatar({ username, avatarUrl, size = 'md', online }: AvatarProps) {
  return (
    <div className="relative flex-shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center`}
        >
          {getInitials(username)}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
            online ? 'bg-green-500' : 'bg-gray-300'
          }`}
        />
      )}
    </div>
  );
}
