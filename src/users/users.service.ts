// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    return this.prisma.user.create({
      data: createUserDto,
      select: this.getUserSelectFields(),
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: this.getUserSelectFields(),
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.getUserSelectFields(),
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: this.getUserSelectFields(),
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id); // Throws if not found

    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: this.getUserSelectFields(),
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.delete({
      where: { id },
    });
  }

  private getUserSelectFields() {
    return {
      id: true,
      email: true,
      username: true,
      name: true,
      image: true,
      country: true,
      mainCurrency: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    };
  }
}
