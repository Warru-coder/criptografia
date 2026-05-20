import cliProgress from 'cli-progress';

export function createProgressBar(): cliProgress.SingleBar {
  return new cliProgress.SingleBar(
    {
      format: '[{bar}] {percentage}% | {value}/{total} bytes | {speed} bytes/s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );
}
