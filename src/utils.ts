export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function setTimeout(resolve: (value: unknown) => void, ms: number): void {
    throw new Error("Function not implemented.");
}

