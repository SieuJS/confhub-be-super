
import { Injectable } from '@nestjs/common';
import { UserService } from '../../user/services/user.service'
import * as crypto from 'crypto'
import { UserDTO } from 'src/modules/user/models/user.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
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

  async login (user : UserDTO) {
    return {
        access_token : this.jwtService.sign({payload : {user}})
    }
  }
}
