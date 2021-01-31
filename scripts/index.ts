import { getClientCapabilities, isRelIncluded, Uri } from '@spgoding/datapack-language-server/lib/types';
import { getTextDocument, walkFile } from '@spgoding/datapack-language-server/lib/services/common';
import { PluginLoader } from '@spgoding/datapack-language-server/lib/plugins/PluginLoader';
import { DatapackLanguageService, readFile } from '@spgoding/datapack-language-server';
import { IdentityNode } from '@spgoding/datapack-language-server/lib/nodes';
import { loadLocale } from '@spgoding/datapack-language-server/lib/locales';
import * as core from '@actions/core';
import path from 'path';
import { findDatapackRoots, getConfiguration, updateCacheFile, getMessageData, outputMessage } from './utils';
import { getSafeMessageData, LintingData } from './types/Results';

const dir = path.resolve(process.cwd(), '../');
lint();

async function lint() {
    // log group start
    core.startGroup('init log');
    // Env Log
    console.log(`dir: ${dir}`);

    // initialize DatapackLanguageService
    const capabilities = getClientCapabilities({ workspace: { configuration: true, didChangeConfiguration: { dynamicRegistration: true } } });
    const service = new DatapackLanguageService({
        capabilities,
        fetchConfig,
        globalStoragePath: path.join(dir, '_storage'),
        plugins: await PluginLoader.load()
    });
    service.init();
    const dirUri = Uri.file(dir);
    const config = await service.getConfig(dirUri);
    service.roots.push(...await findDatapackRoots(dirUri, config));
    // Env Log
    console.log('datapack roots:');
    service.roots.forEach(v => console.log(v));
    await updateCacheFile(service);

    // Lint Region
    const results: LintingData = {};
    await Promise.all(service.roots.map(async root =>
        await walkFile(
            root.fsPath,
            path.join(root.fsPath, 'data'),
            async (file, rel) => {
                // language check region
                const dotIndex = file.lastIndexOf('.');
                const slashIndex = file.lastIndexOf('/');
                const langID = dotIndex !== -1 && slashIndex < dotIndex ? file.substring(dotIndex + 1) : '';
                if (!(langID === 'mcfunction' || langID === 'json'))
                    return;

                // parsing data
                const text = await readFile(file);
                const textDoc = await getTextDocument({ uri: Uri.file(file), langID, version: null, getText: async () => text });
                const parseData = await service.parseDocument(textDoc);

                // get IdentityNode
                const { id, category } = IdentityNode.fromRel(rel) ?? {};

                // undefined check
                if (!parseData || !id || !category)
                    return;

                // pushing message
                getSafeMessageData(results, category).push(getMessageData(parseData, id, textDoc, root, rel));
            },
            async (_, rel) => isRelIncluded(rel, config)
        )
    ));

    // log group end
    core.endGroup();

    // message output
    const failCount = outputMessage(results);

    // last message output
    if (failCount.error + failCount.warning === 0) {
        core.info('Check successful');
    } else {
        const errorMul = failCount.error > 1 ? 's' : '';
        const warningMul = failCount.warning > 1 ? 's' : '';
        core.info(`Check failed (${failCount.error} error${errorMul}, ${failCount.warning} warning${warningMul})`);
        process.exitCode = core.ExitCode.Failure;
    }
}

async function fetchConfig() {
    const configUri = Uri.file(path.resolve(dir, './.vscode/settings.json'));
    const config = await getConfiguration(configUri.fsPath);
    await loadLocale(config.env.language, 'en');
    return config;
}