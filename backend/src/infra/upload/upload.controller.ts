import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiCookieAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { rename, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { fileTypeFromFile } from 'file-type';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

@ApiTags('Upload')
@ApiCookieAuth('access_token')
@Controller('upload')
export class UploadController {
  @ApiOperation({ summary: 'Upload an image file (max 10 MB; jpeg/png/gif/webp only)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Upload succeeded; returns { url }' })
  @ApiResponse({ status: 400, description: 'File missing, too large, or wrong type' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, _file, cb) => cb(null, randomUUID()),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Only image files allowed'), false);
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    const detected = await fileTypeFromFile(file.path);
    if (!detected || !ALLOWED_MIME.has(detected.mime)) {
      await unlink(file.path);
      throw new BadRequestException('Only image files allowed');
    }

    const safeFilename = `${file.filename}.${detected.ext}`;
    await rename(file.path, join(file.destination, safeFilename));

    return { url: `/uploads/${safeFilename}` };
  }
}
