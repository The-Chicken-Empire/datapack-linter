import { FileType } from '@spgoding/datapack-language-server/lib/types';
import { DiagnosticSeverity } from 'vscode-json-languageservice';
export declare type LintingData = {
    [type in FileType]?: MessageData[];
};
export interface MessageData {
    title: string;
    messages: Output[];
}
export interface Output {
    severity: DiagnosticSeverity;
    message: string;
}
export interface FailCount {
    warning: number;
    error: number;
}
export declare function getSafeMessageData(data: LintingData, type: FileType): MessageData[];
