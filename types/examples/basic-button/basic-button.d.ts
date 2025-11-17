import { type Component } from '../..';
declare global {
    interface HTMLElementTagNameMap {
        'basic-button': Component<{
            disabled: boolean;
        }, {
            button: HTMLButtonElement;
        }>;
    }
}
declare const _default: Component<{
    disabled: boolean;
}, {
    button: HTMLButtonElement;
}>;
export default _default;
