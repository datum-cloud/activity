// Adapter: maps the legacy shadcn-style `variant`/`size` props used by
// activity-ui call sites onto datum-ui's `type`/`theme`/`size` API.
//
// Notes on the `type` collision:
//   - shadcn Button leaves `type` as the native HTML button attribute
//     ("button" | "submit" | "reset").
//   - datum-ui Button repurposes `type` for the visual variant (primary,
//     secondary, danger, …) and exposes `htmlType` for the native attr.
// Existing call sites pass `type="button"` (native), so this shim accepts
// the native attribute and forwards it as `htmlType` to datum-ui.
import * as React from 'react';
import {
  Button as DUIButton,
  buttonVariants as duiButtonVariants,
} from '@datum-cloud/datum-ui/button';
import type { ButtonProps as DUIButtonProps } from '@datum-cloud/datum-ui/button';

type LegacyVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';
type LegacySize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: LegacyVariant;
  size?: LegacySize;
  /** Native HTML button type — same semantics as on a plain <button>. */
  type?: 'button' | 'submit' | 'reset';
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  block?: boolean;
}

function mapVariant(variant: LegacyVariant | undefined): {
  type: DUIButtonProps['type'];
  theme: DUIButtonProps['theme'];
} {
  switch (variant) {
    case 'destructive':
      return { type: 'danger', theme: 'solid' };
    case 'outline':
      return { type: 'tertiary', theme: 'outline' };
    case 'secondary':
      return { type: 'secondary', theme: 'solid' };
    case 'ghost':
      return { type: 'quaternary', theme: 'borderless' };
    case 'link':
      return { type: 'primary', theme: 'link' };
    case 'default':
    case undefined:
    default:
      return { type: 'primary', theme: 'solid' };
  }
}

function mapSize(size: LegacySize | undefined): DUIButtonProps['size'] {
  switch (size) {
    case 'sm':
      return 'small';
    case 'lg':
      return 'large';
    case 'icon':
      return 'icon';
    default:
      return 'default';
  }
}

function Button({
  variant,
  size,
  type,
  ref,
  ...rest
}: ButtonProps & { ref?: React.RefObject<HTMLButtonElement | null> }) {
  const { type: duiType, theme } = mapVariant(variant);
  return (
    <DUIButton
      ref={ref}
      type={duiType}
      theme={theme}
      size={mapSize(size)}
      htmlType={type}
      {...rest}
    />
  );
}
Button.displayName = 'Button';

const buttonVariants: typeof duiButtonVariants = duiButtonVariants;

export { Button, buttonVariants };
