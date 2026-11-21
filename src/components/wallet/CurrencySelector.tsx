import { useId } from "react";
import { cn } from "@/lib/utils";

const currencies = [
  { code: "NGN", symbol: "₦" },
  { code: "USD", symbol: "$" },
] as const;

type Currency = (typeof currencies)[number]["code"];

export function CurrencySelector({ value, onChange, onDark = false }: {
  value: Currency;
  onChange: (currency: Currency) => void;
  onDark?: boolean;
}) {
  const name = useId();

  return (
    <fieldset className={cn("currency-selector", onDark && "currency-selector-dark")}>
      <legend className="sr-only">Display currency</legend>
      <div className="currency-options">
        {currencies.map(({ code, symbol }) => (
          <label key={code} className="currency-option">
            <input
              type="radio"
              name={name}
              value={code}
              checked={value === code}
              onChange={() => onChange(code)}
              className="sr-only"
            />
            <span>
              <span aria-hidden="true">{symbol}</span>
              {code}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
