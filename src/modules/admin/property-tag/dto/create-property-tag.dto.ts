import { IsOptional, IsString } from "class-validator";

export class CreatePropertyTagDto {
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  video?: string;

  /*
  |--------------------------------------------------------------------------
  | STAT JSON (string from FormData -> parsed in service/controller)
  |--------------------------------------------------------------------------
  */

  @IsOptional()
  stat?: {
    hosts?: string;
    guests?: string;
    time?: string;
  };

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;
}