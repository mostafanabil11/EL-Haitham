import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id: string = '';

  @ApiProperty({ example: '201012345678' })
  phone: string = '';

  @ApiProperty({ example: '201012345678' })
  parentPhone: string = '';

  @ApiProperty()
  name: string = '';

  @ApiProperty({ enum: ['prep3', 'sec1', 'sec2', 'sec3'] })
  grade: string = 'sec3';

  @ApiProperty({ nullable: true })
  email: string | null = null;

  @ApiProperty({ enum: ['student', 'admin'] })
  role: string = 'student';

  @ApiProperty()
  createdAt: Date = new Date();
}

export class LoginResponseDto {
  @ApiProperty()
  success: boolean = true;

  @ApiProperty()
  message: string = '';

  @ApiProperty()
  data: {
    accessToken: string;
    user: UserResponseDto;
  } = {
    accessToken: '',
    user: new UserResponseDto(),
  };
}

export class RegisterResponseDto {
  @ApiProperty()
  success: boolean = true;

  @ApiProperty()
  message: string = '';

  @ApiProperty()
  data: {
    accessToken: string;
    user: UserResponseDto;
  } = {
    accessToken: '',
    user: new UserResponseDto(),
  };
}

export class GenericResponseDto<T> {
  @ApiProperty()
  success: boolean = true;

  @ApiProperty()
  message: string = '';

  @ApiProperty()
  data?: T;

  @ApiProperty()
  error?: string;
}
