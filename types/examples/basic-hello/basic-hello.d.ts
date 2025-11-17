import { type Component } from '../..';
declare global {
    interface HTMLElementTagNameMap {
        'basic-hello': Component<{
            name: string;
        }, {
            input: HTMLInputElement;
            output: HTMLOutputElement;
        }>;
    }
}
declare const _default: Component<{
    name: string;
}, {
    input: HTMLInputElement;
    output: HTMLOutputElement;
}>;
export default _default;
