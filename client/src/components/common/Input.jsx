import React from "react";

function Input({ name, state, setState, label = false, required = false, type = "text", autoComplete }) {
  const inputId = `${name}-field`;
  return (
    <div className="flex gap-1 flex-col w-full">
      {label && (
        <label htmlFor={inputId} className="text-lg px-1 font-semibold text-light-accent dark:text-dark-accent">
          {name}
        </label>
      )}
      <div>
        <input
          id={inputId}
          type={type}
          name={name}
          value={state}
          onChange={(e) => setState(e.target.value)}
          aria-required={required}
          required={required}
          autoComplete={autoComplete}
          className="text-start focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 h-11 rounded-xl px-5 py-2 w-full shadow-sm transition-all duration-200 bg-light-surface dark:bg-dark-surface text-light-primary-text dark:text-dark-primary-text border border-light-divider dark:border-dark-divider focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus-visible:outline-light-accent dark:focus-visible:outline-dark-accent"
        />
      </div>
    </div>
  );
}

export default Input;

