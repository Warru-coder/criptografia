import fs from 'fs';
import { pipeline } from 'stream/promises';
import { STREAM_HIGH_WATER_MARK } from '../core/constants';

export interface StreamOptions {
  highWaterMark?: number;
  start?: number;
  end?: number;
}

export function createReadStream(
  filePath: string,
  options: StreamOptions = {}
): fs.ReadStream {
  return fs.createReadStream(filePath, {
    highWaterMark: options.highWaterMark || STREAM_HIGH_WATER_MARK,
    start: options.start,
    end: options.end,
  });
}

export function createWriteStream(
  filePath: string,
  append = false
): fs.WriteStream {
  return fs.createWriteStream(filePath, {
    flags: append ? 'a' : 'w',
    highWaterMark: STREAM_HIGH_WATER_MARK,
  });
}

export async function pipeStreams(
  source: fs.ReadStream,
  destination: fs.WriteStream,
  transform?: NodeJS.ReadWriteStream
): Promise<void> {
  if (transform) {
    await pipeline(source, transform, destination);
  } else {
    await pipeline(source, destination);
  }
}
