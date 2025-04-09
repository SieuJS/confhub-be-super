
import { HttpException, Injectable } from '@nestjs/common';
import { UserService } from '../../user/services/user.service'
import * as crypto from 'crypto'
import { UserDTO } from 'src/modules/user/models/user.dto';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from 'src/modules/user/services/admin.service';
import { AdminDto } from 'src/modules/user/models/admin/admin.dto';
import { PayloadToken } from '../models/payload-token';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private admin : AdminService,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.getUserByEmail(email)
    if(!user) {
        throw Error ("No email match")
    }

    const hashedInputPassword = crypto.createHash('sha256').update(password).digest('hex')
    const isPasswordValid = hashedInputPassword === user.password
    if(!isPasswordValid){
        throw Error ("Wrong password")
    }
    return user;
  }

  async validateAdmin (email: string, password: string): Promise<any> {
    const admin = await this.admin.getAdminByEmail(email)
    if(!admin) {
        throw Error ("No email match")
    }
    const hashedInputPassword = crypto.createHash('sha256').update(password).digest('hex')
    const isPasswordValid = hashedInputPassword === admin.password
    if(!isPasswordValid){
        throw Error ("Wrong password")
    }
    return admin;
  }

  async loginUser (user : UserDTO) {
    return {
        token : this.jwtService.sign({payload : {
          id : user.id,
          email : user.email,
          role : 'user'
        }}),
        user 
    }
  }

  async loginAdmin (admin : AdminDto) {
    return {
        access_token : this.jwtService.sign({payload : {
          id : admin.id,
          email : admin.email,
          role : 'admin'
        }},)
    }
  }

  async validateJwtAdmin (payload : PayloadToken) {
    if(!payload) {
      throw new HttpException('Invalid token',401);
    }
    if(payload.role !== 'admin') {
      throw new HttpException('Unauthorized',401 );
    }
    const admin = await this.admin.getAdminById(payload.id);
    if(!admin) {
      throw new HttpException('Wrong token',401);
    }
    if(admin.email !== payload.email) {
      throw new HttpException('Wrong token',401);
    }
    return true
  }

  async validateJwtUser (payload : PayloadToken) {
    if(!payload) {
      throw new HttpException('Invalid token', 401);
    }
    if(payload.role !== 'user') {
      throw new HttpException('Unauthorized', 401);
    }
    const user = await this.usersService.getUserById(payload.id);
    if(!user) {
      throw new HttpException('Wrong token', 401);
    }
    if(user.email !== payload.email) {
      throw new HttpException('Wrong token', 401);
    }
    return true
  }

}
