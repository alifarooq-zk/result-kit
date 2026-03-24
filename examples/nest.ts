import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { ResultKit, type Result, type TypedErrorUnion } from 'result-kit';
import { unwrapOrThrow } from 'result-kit/nest';

type UserError = TypedErrorUnion<'not_found' | 'validation_error'>;

class UserService {
  async findUser(id: string): Promise<Result<{ id: string }, UserError>> {
    if (!id.trim()) {
      return ResultKit.fail({
        type: 'validation_error',
        message: 'id is required',
      });
    }

    if (id !== '123') {
      return ResultKit.fail({
        type: 'not_found',
        message: 'User not found',
      });
    }

    return ResultKit.success({ id });
  }
}

@Controller('users')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const result = await this.service.findUser(id);

    return unwrapOrThrow(result, {
      mapError: (error) => {
        if (!ResultKit.isTypedError(error)) {
          return undefined;
        }

        if (error.type === 'validation_error') {
          return new BadRequestException(error.message);
        }

        if (error.type === 'not_found') {
          return new NotFoundException(error.message);
        }

        return undefined;
      },
    });
  }
}
