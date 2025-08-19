import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @ApiProperty()
  email!: string;

  @IsString()
  @ApiProperty()
  password!: string;
}

export class LoginResponse {
  access_token: string;
  user: { id: string; email: string; role: Role };
}
