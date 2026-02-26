import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TOUR_STEPS, TOUR_STORAGE_KEY, type TourStep } from '@/data/tourSteps';

interface TourContextValue {
    /** Whether the tour is currently active */
    isActive: boolean;
    /** Current step index (0-based) */
    currentStep: number;
    /** The current TourStep object, or null if inactive */
    step: TourStep | null;
    /** Total number of steps */
    totalSteps: number;
    /** Start the tour from step 0 */
    start: () => void;
    /** Advance to next step (or finish if last) */
    next: () => void;
    /** Go back one step */
    prev: () => void;
    /** Skip / dismiss the tour entirely */
    skip: () => void;
    /** Whether the user has completed the tour before */
    hasCompleted: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const location = useLocation();

    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [hasCompleted, setHasCompleted] = useState(() => {
        return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
    });

    const step = isActive ? TOUR_STEPS[currentStep] ?? null : null;

    const markCompleted = useCallback(() => {
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
        setHasCompleted(true);
    }, []);

    const start = useCallback(() => {
        setCurrentStep(0);
        setIsActive(true);
        const firstStep = TOUR_STEPS[0];
        if (firstStep && location.pathname !== firstStep.route) {
            navigate(firstStep.route);
        }
    }, [navigate, location.pathname]);

    const finish = useCallback(() => {
        setIsActive(false);
        setCurrentStep(0);
        markCompleted();
    }, [markCompleted]);

    const next = useCallback(() => {
        if (currentStep >= TOUR_STEPS.length - 1) {
            finish();
            return;
        }
        const nextIdx = currentStep + 1;
        const nextStep = TOUR_STEPS[nextIdx];
        setCurrentStep(nextIdx);
        if (nextStep && location.pathname !== nextStep.route) {
            navigate(nextStep.route);
        }
    }, [currentStep, finish, navigate, location.pathname]);

    const prev = useCallback(() => {
        if (currentStep <= 0) return;
        const prevIdx = currentStep - 1;
        const prevStep = TOUR_STEPS[prevIdx];
        setCurrentStep(prevIdx);
        if (prevStep && location.pathname !== prevStep.route) {
            navigate(prevStep.route);
        }
    }, [currentStep, navigate, location.pathname]);

    const skip = useCallback(() => {
        setIsActive(false);
        setCurrentStep(0);
        markCompleted();
    }, [markCompleted]);

    return (
        <TourContext.Provider
            value={{
                isActive,
                currentStep,
                step,
                totalSteps: TOUR_STEPS.length,
                start,
                next,
                prev,
                skip,
                hasCompleted,
            }}
        >
            {children}
        </TourContext.Provider>
    );
}

export function useTour(): TourContextValue {
    const ctx = useContext(TourContext);
    if (!ctx) throw new Error('useTour must be used within TourProvider');
    return ctx;
}
