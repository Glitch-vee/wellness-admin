import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "default" | "dark" | "green" | "danger";

/** Thin wrapper around the site's own .btn CSS system — no external UI
 * library dependency (this project doesn't use one). */
export function Button({
  variant = "default",
  size,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm";
}) {
  const cls = [
    "btn",
    variant !== "default" ? `btn--${variant}` : "",
    size === "sm" ? "btn--sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={cls} {...props} />;
}

export default Button;
