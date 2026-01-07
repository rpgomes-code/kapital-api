import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const createUserDto = { email: 'test@example.com', name: 'Test User' };
      const expectedResult = { id: '1', ...createUserDto };
      mockUsersService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createUserDto);

      expect(result).toEqual(expectedResult);
      expect(mockUsersService.create).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const expectedResult = [{ id: '1', email: 'test@example.com' }];
      mockUsersService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(result).toEqual(expectedResult);
      expect(mockUsersService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const userId = '1';
      const expectedResult = { id: userId, email: 'test@example.com' };
      mockUsersService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(userId);

      expect(result).toEqual(expectedResult);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(userId);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const userId = '1';
      const updateUserDto = { name: 'Updated Name' };
      const expectedResult = { id: userId, ...updateUserDto };
      mockUsersService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(userId, updateUserDto);

      expect(result).toEqual(expectedResult);
      expect(mockUsersService.update).toHaveBeenCalledWith(userId, updateUserDto);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      const userId = '1';
      mockUsersService.remove.mockResolvedValue({ id: userId });

      const result = await controller.remove(userId);

      expect(result).toEqual({ id: userId });
      expect(mockUsersService.remove).toHaveBeenCalledWith(userId);
    });
  });

  describe('getMe', () => {
    it('should return current user profile', async () => {
      const session = { user: { id: '1' } } as any;
      const expectedResult = { id: '1', email: 'test@example.com' };
      mockUsersService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.getMe(session);

      expect(result).toEqual(expectedResult);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('updateMe', () => {
    it('should update current user profile', async () => {
      const session = { user: { id: '1' } } as any;
      const updateUserDto = { name: 'New Name' };
      const expectedResult = { id: '1', ...updateUserDto };
      mockUsersService.update.mockResolvedValue(expectedResult);

      const result = await controller.updateMe(session, updateUserDto);

      expect(result).toEqual(expectedResult);
      expect(mockUsersService.update).toHaveBeenCalledWith('1', updateUserDto);
    });
  });
});
