import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const uploadsPath = join(process.cwd(), 'uploads');

function ensureUploadsDir() {
  if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, { recursive: true });
  }
}

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadsDir();
          cb(null, uploadsPath);
        },
        filename: (_req, file, cb) => {
          const extension = extname(file.originalname || '').toLowerCase();
          cb(null, `${Date.now()}-${randomUUID()}${extension}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          return cb(new BadRequestException('Envie apenas arquivos de imagem.'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Imagem não enviada.');
    }

    return {
      url: `/uploads/${file.filename}`,
    };
  }
}

