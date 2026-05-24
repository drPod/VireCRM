/**
 * Instruments the React Router Data Router for pageloads and navigation.
 *
 * This function waits for the router to be available after hydration, then:
 * 1. Updates the pageload transaction with parameterized route info
 * 2. Patches router.navigate() to create navigation transactions
 * 3. Subscribes to router state changes to update navigation transactions with parameterized routes
 */
export declare function instrumentHydratedRouter(): void;
//# sourceMappingURL=hydratedRouter.d.ts.map