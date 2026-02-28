/**
 * AddressAutocomplete
 *
 * Google Places-powered address autocomplete input.
 * Wraps itself in an APIProvider so it can be dropped anywhere without
 * a parent provider requirement.
 *
 * Usage:
 *   // With React Hook Form (Controller):
 *   <Controller
 *     name="projectAddress"
 *     control={control}
 *     render={({ field }) => (
 *       <AddressAutocomplete
 *         value={field.value}
 *         onChange={field.onChange}
 *         placeholder="123 Main St, Troy, NY 12180"
 *       />
 *     )}
 *   />
 *
 *   // Standalone:
 *   <AddressAutocomplete
 *     value={address}
 *     onChange={(addr) => setAddress(addr)}
 *   />
 */

/// <reference types="@types/google.maps" />

import {
    useState,
    useRef,
    useEffect,
    useCallback,
    type KeyboardEvent,
} from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { cn } from '@/lib/utils';
import { inputStyles } from './FormField';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AddressAutocompleteProps {
    value: string;
    onChange: (address: string) => void;
    placeholder?: string;
    className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const DEBOUNCE_MS = 300;

// ── Fallback input (no API key configured) ────────────────────────────────────

function PlainTextInput({
    value,
    onChange,
    placeholder,
    className,
}: AddressAutocompleteProps) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? '123 Main St, City, State ZIP'}
            className={cn(inputStyles, className)}
            autoComplete="street-address"
        />
    );
}

// ── Core autocomplete (rendered inside APIProvider) ───────────────────────────

interface AutocompleteInputProps extends AddressAutocompleteProps {
    /** Pass-through so we can re-expose the same signature */
    _?: never;
}

function AutocompleteInput({
    value,
    onChange,
    placeholder,
    className,
}: AutocompleteInputProps) {
    const placesLib = useMapsLibrary('places');

    const [inputValue, setInputValue] = useState(value);
    const [suggestions, setSuggestions] = useState<
        google.maps.places.AutocompletePrediction[]
    >([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [sessionToken, setSessionToken] =
        useState<google.maps.places.AutocompleteSessionToken | null>(null);

    const serviceRef =
        useRef<google.maps.places.AutocompleteService | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep internal state in sync when parent value changes (e.g. form reset)
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // Initialise the AutocompleteService once the places library is loaded
    useEffect(() => {
        if (!placesLib) return;
        serviceRef.current = new placesLib.AutocompleteService();
        setSessionToken(new placesLib.AutocompleteSessionToken());
    }, [placesLib]);

    // Close dropdown when user clicks outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
                setActiveIndex(-1);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch predictions from Google Places
    const fetchPredictions = useCallback(
        (query: string) => {
            if (!serviceRef.current || !query.trim()) {
                setSuggestions([]);
                setIsOpen(false);
                return;
            }

            serviceRef.current.getPlacePredictions(
                {
                    input: query,
                    sessionToken: sessionToken ?? undefined,
                    // Bias toward address-level results
                    types: ['address'],
                },
                (
                    predictions: google.maps.places.AutocompletePrediction[] | null,
                    status: google.maps.places.PlacesServiceStatus
                ) => {
                    if (
                        status ===
                            google.maps.places.PlacesServiceStatus.OK &&
                        predictions
                    ) {
                        setSuggestions(predictions);
                        setIsOpen(true);
                        setActiveIndex(-1);
                    } else {
                        setSuggestions([]);
                        setIsOpen(false);
                    }
                }
            );
        },
        [sessionToken]
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setInputValue(raw);
        onChange(raw); // keep RHF up-to-date as the user types

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchPredictions(raw), DEBOUNCE_MS);
    };

    const selectSuggestion = useCallback(
        (prediction: google.maps.places.AutocompletePrediction) => {
            const fullAddress = prediction.description;
            setInputValue(fullAddress);
            onChange(fullAddress);
            setSuggestions([]);
            setIsOpen(false);
            setActiveIndex(-1);

            // Rotate the session token after a selection to start a new billing session
            if (placesLib) {
                setSessionToken(new placesLib.AutocompleteSessionToken());
            }

            // Return focus to the input
            inputRef.current?.focus();
        },
        [onChange, placesLib]
    );

    // Keyboard navigation: arrow keys, enter, escape
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex((prev) =>
                    prev < suggestions.length - 1 ? prev + 1 : 0
                );
                break;

            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex((prev) =>
                    prev > 0 ? prev - 1 : suggestions.length - 1
                );
                break;

            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0 && suggestions[activeIndex]) {
                    selectSuggestion(suggestions[activeIndex]);
                }
                break;

            case 'Escape':
                setIsOpen(false);
                setActiveIndex(-1);
                break;

            case 'Tab':
                // Let Tab close the dropdown naturally without blocking focus movement
                setIsOpen(false);
                setActiveIndex(-1);
                break;
        }
    };

    // Highlight matching text within a suggestion description
    const highlightMatch = (
        prediction: google.maps.places.AutocompletePrediction
    ) => {
        const { matched_substrings, structured_formatting } = prediction;
        const mainText = structured_formatting.main_text;
        const secondaryText = structured_formatting.secondary_text;

        if (!matched_substrings?.length) {
            return (
                <>
                    <span className="font-medium text-slate-900">{mainText}</span>
                    {secondaryText && (
                        <span className="text-slate-400">, {secondaryText}</span>
                    )}
                </>
            );
        }

        // Build highlighted spans for main text only (secondary is context)
        const parts: React.ReactNode[] = [];
        let cursor = 0;
        const mainMatches = matched_substrings.filter(
            (m: google.maps.places.PredictionSubstring) =>
                m.offset < mainText.length
        );

        mainMatches.forEach(({ offset, length }: google.maps.places.PredictionSubstring, i: number) => {
            if (offset > cursor) {
                parts.push(
                    <span key={`pre-${i}`} className="font-medium text-slate-900">
                        {mainText.slice(cursor, offset)}
                    </span>
                );
            }
            parts.push(
                <span key={`match-${i}`} className="font-bold text-blue-600">
                    {mainText.slice(offset, offset + length)}
                </span>
            );
            cursor = offset + length;
        });

        if (cursor < mainText.length) {
            parts.push(
                <span key="tail" className="font-medium text-slate-900">
                    {mainText.slice(cursor)}
                </span>
            );
        }

        return (
            <>
                {parts}
                {secondaryText && (
                    <span className="text-slate-400">, {secondaryText}</span>
                )}
            </>
        );
    };

    // While the places library loads, render a disabled plain input
    if (!placesLib) {
        return (
            <input
                type="text"
                value={inputValue}
                disabled
                placeholder={placeholder ?? '123 Main St, City, State ZIP'}
                className={cn(inputStyles, 'opacity-60 cursor-wait', className)}
                aria-label="Loading address autocomplete..."
            />
        );
    }

    return (
        <div ref={containerRef} className="relative w-full">
            <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-autocomplete="list"
                aria-controls="address-autocomplete-listbox"
                aria-activedescendant={
                    activeIndex >= 0
                        ? `address-option-${activeIndex}`
                        : undefined
                }
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (suggestions.length > 0) setIsOpen(true);
                }}
                placeholder={placeholder ?? '123 Main St, City, State ZIP'}
                autoComplete="off"
                spellCheck={false}
                className={cn(inputStyles, className)}
            />

            {/* Dropdown */}
            {isOpen && suggestions.length > 0 && (
                <ul
                    id="address-autocomplete-listbox"
                    role="listbox"
                    aria-label="Address suggestions"
                    className={cn(
                        // Positioning
                        'absolute z-50 w-full mt-1',
                        // Appearance — white card matching form whites, not the dark sidebar
                        'bg-white border border-slate-200 rounded-lg shadow-lg',
                        // Scroll cap so it never breaks out of viewport
                        'max-h-60 overflow-y-auto',
                        // Subtle animation
                        'animate-in fade-in-0 zoom-in-95 duration-100'
                    )}
                >
                    {suggestions.map((prediction, index) => (
                        <li
                            key={prediction.place_id}
                            id={`address-option-${index}`}
                            role="option"
                            aria-selected={index === activeIndex}
                            // mousedown before blur so the click registers before the input loses focus
                            onMouseDown={(e) => {
                                e.preventDefault();
                                selectSuggestion(prediction);
                            }}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={cn(
                                'flex items-start gap-2.5 px-3 py-2.5 cursor-pointer text-sm transition-colors select-none',
                                // Remove default border-radius on first/last within rounded container
                                index === 0 && 'rounded-t-lg',
                                index === suggestions.length - 1 && 'rounded-b-lg',
                                index === activeIndex
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                            )}
                        >
                            {/* Pin icon */}
                            <svg
                                className={cn(
                                    'w-3.5 h-3.5 mt-0.5 shrink-0',
                                    index === activeIndex
                                        ? 'text-blue-500'
                                        : 'text-slate-400'
                                )}
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.003 3.5-4.697 3.5-8.123a8.25 8.25 0 00-16.5 0c0 3.426 1.556 6.12 3.5 8.123a19.58 19.58 0 002.683 2.282 16.974 16.974 0 001.144.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
                                    clipRule="evenodd"
                                />
                            </svg>

                            {/* Address text with match highlighting */}
                            <span className="truncate leading-snug">
                                {highlightMatch(prediction)}
                            </span>
                        </li>
                    ))}

                    {/* Google attribution — required by ToS */}
                    <li
                        aria-hidden="true"
                        className="flex items-center justify-end gap-1.5 px-3 py-1.5 border-t border-slate-100"
                    >
                        <span className="text-[10px] text-slate-400">powered by</span>
                        <svg
                            height="14"
                            viewBox="0 0 58 18"
                            aria-label="Google"
                            role="img"
                            className="opacity-50"
                        >
                            <path
                                d="M6.9 1.4C3.6 1.4 1 4 1 7.3c0 3.2 2.5 5.7 5.9 5.7 2 0 3.4-.7 4.4-1.8l-1.8-1.8c-.6.6-1.5 1-2.6 1-1.8 0-3.3-1.2-3.8-2.9H12v-.6C12 3.8 9.7 1.4 6.9 1.4zm-3.8 5C3.5 5 5 3.9 6.9 3.9c1.9 0 3.1 1.1 3.3 2.5H3.1zM20 3.9V2h-2v1.2C17.4 2.4 16.3 2 15 2c-3 0-5.2 2.3-5.2 5.2s2.2 5.2 5.2 5.2c1.3 0 2.4-.4 3-1.2V12c0 1.6-1 2.6-2.8 2.6-1.3 0-2.3-.6-2.7-1.5l-2 1.2C11.3 16 13 17 15.2 17c3.2 0 5-1.8 5-4.9V3.9zm-5.3 5.6c-1.6 0-2.8-1.2-2.8-2.8 0-1.6 1.2-2.8 2.8-2.8 1.5 0 2.8 1.2 2.8 2.8 0 1.6-1.3 2.8-2.8 2.8zM24 7.2c0-1.8 1.2-3 2.8-3 1.5 0 2.4.9 2.4 2.5V13h2.2V6.4c0-2.6-1.5-4.4-3.9-4.4-1.2 0-2.2.5-2.9 1.3V2.2H22.4v10.9h2.2l-.6-5.9zM34.6 0h-2.2v13h2.2V0zM42 2c-3 0-5.3 2.3-5.3 5.2 0 2.9 2.3 5.2 5.3 5.2 3 0 5.3-2.3 5.3-5.2C47.3 4.3 45 2 42 2zm0 8.3c-1.7 0-3-1.3-3-3.1 0-1.8 1.3-3.1 3-3.1 1.7 0 3 1.3 3 3.1 0 1.8-1.3 3.1-3 3.1zM55.1 2c-1.3 0-2.4.5-3.1 1.3V2.2h-2V17h2.2v-5.3c.7.8 1.8 1.3 3 1.3 2.9 0 5-2.3 5-5.2C60.3 4.3 58.1 2 55.1 2zm-.4 8.3c-1.7 0-3-1.3-3-3.1 0-1.8 1.3-3.1 3-3.1 1.7 0 3 1.3 3 3.1 0 1.8-1.3 3.1-3 3.1z"
                                fill="#5F6368"
                            />
                        </svg>
                    </li>
                </ul>
            )}
        </div>
    );
}

// ── Public component (handles APIProvider wrapping + key fallback) ─────────────

/**
 * AddressAutocomplete — drop-in replacement for a plain address <input>.
 *
 * Automatically wraps itself in an APIProvider. If VITE_GOOGLE_MAPS_API_KEY
 * is not set it silently degrades to a plain text input so forms never break.
 */
export function AddressAutocomplete(props: AddressAutocompleteProps) {
    if (!GOOGLE_MAPS_API_KEY) {
        return <PlainTextInput {...props} />;
    }

    return (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
            <AutocompleteInput {...props} />
        </APIProvider>
    );
}
