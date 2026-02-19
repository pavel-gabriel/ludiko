import type { ButtonHTMLAttributes } from 'react';

type Variant = 'pink' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

const variantClasses: Record<Variant, string> = {
  pink: 'bg-ludiko-pink hover:bg-pink-300',
  blue: 'bg-ludiko-blue hover:bg-sky-300',
  green: 'bg-ludiko-green hover:bg-green-300',
  yellow: 'bg-ludiko-yellow hover:bg-yellow-200',
  purple: 'bg-ludiko-purple hover:bg-purple-300',
  orange: 'bg-ludiko-orange hover:bg-orange-200',
};

const sizeClasses = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-6 py-3 text-lg rounded-xl',
  lg: 'px-8 py-4 text-xl rounded-2xl',
};

export default function Button({
  variant = 'blue',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        font-bold text-ludiko-text
        transition-all duration-200
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        shadow-md hover:shadow-lg
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
