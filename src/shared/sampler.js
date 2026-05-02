// Arquivos com prioridade máxima — sempre incluídos se existirem
const PRIORITY_FILES = [
    'README.md',
    'readme.md',
    'README.rst',
    'package.json',
    'requirements.txt',
    'requirements-dev.txt',
    'pyproject.toml',
    'setup.py',
    'go.mod',
    'go.sum',
    'Cargo.toml',
    'Gemfile',
    'pom.xml',
    'build.gradle',
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    '.github/workflows',
    'tsconfig.json',
    'vite.config.ts',
    'vite.config.js',
    'webpack.config.js',
    'next.config.js',
    '.eslintrc.json',
    '.eslintrc.js',
    'jest.config.ts',
    'jest.config.js',
];
// Extensões de código aceitas para análise
const CODE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs',
    '.py', '.go', '.rs', '.java', '.kt',
    '.rb', '.php', '.cs', '.cpp', '.c',
    '.swift', '.scala', '.ex', '.exs',
    '.vue', '.svelte',
    '.sql', '.graphql', '.gql',
    '.yaml', '.yml', '.toml', '.json',
    '.env.example', '.env.sample',
]);
// Padrões a ignorar completamente
const IGNORE_PATTERNS = [
    /node_modules\//,
    /\.git\//,
    /dist\//,
    /build\//,
    /\.next\//,
    /\.nuxt\//,
    /coverage\//,
    /\.cache\//,
    /vendor\//,
    /target\//,
    /\.min\.(js|css)$/,
    /\.lock$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
    /\.map$/,
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
    /\.(pdf|zip|tar|gz|mp4|mp3)$/,
];
function getExtension(path) {
    const lastDot = path.lastIndexOf('.');
    if (lastDot === -1)
        return '';
    return path.slice(lastDot).toLowerCase();
}
function isPriority(path) {
    const filename = path.split('/').pop() ?? path;
    return PRIORITY_FILES.some((p) => filename === p || path === p || path.startsWith(p));
}
function shouldIgnore(path) {
    return IGNORE_PATTERNS.some((pattern) => pattern.test(path));
}
function isCodeFile(path) {
    const ext = getExtension(path);
    return CODE_EXTENSIONS.has(ext);
}
/**
 * Estima tokens de um texto (aproximação: 1 token ≈ 4 chars)
 */
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
export function sampleFiles(tree, options = {}) {
    const { maxFiles = 40, maxTokensPerFile = 8000, } = options;
    const filtered = tree.filter((f) => !shouldIgnore(f.path) && (isPriority(f.path) || isCodeFile(f.path)));
    // Separa prioritários dos demais
    const priority = filtered.filter((f) => isPriority(f.path));
    const rest = filtered
        .filter((f) => !isPriority(f.path))
        .sort((a, b) => {
        // Prioriza arquivos menores (mais fáceis de incluir) e em src/
        const aInSrc = a.path.startsWith('src/') || a.path.startsWith('lib/') ? -1 : 0;
        const bInSrc = b.path.startsWith('src/') || b.path.startsWith('lib/') ? -1 : 0;
        return aInSrc - bInSrc || a.size - b.size;
    });
    const selected = [];
    const maxSizeBytes = maxTokensPerFile * 4; // bytes
    for (const file of [...priority, ...rest]) {
        if (selected.length >= maxFiles)
            break;
        if (file.size > maxSizeBytes)
            continue; // pula arquivos muito grandes
        selected.push(file);
    }
    return selected;
}
export function buildContext(files, maxTotalTokens = 800000) {
    const result = [];
    let totalTokens = 0;
    for (const file of files) {
        const tokens = estimateTokens(file.content);
        if (totalTokens + tokens > maxTotalTokens) {
            // Inclui o arquivo truncado se ainda tiver espaço
            const available = maxTotalTokens - totalTokens;
            if (available > 500) {
                const truncated = file.content.slice(0, available * 4);
                result.push({ path: file.path, content: truncated + '\n... [truncado]' });
                totalTokens = maxTotalTokens;
            }
            break;
        }
        result.push(file);
        totalTokens += tokens;
    }
    return result;
}
export { estimateTokens };
