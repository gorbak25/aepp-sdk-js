/*
 * ISC License (ISC)
 * Copyright 2018 aeternity developers
 *
 *  Permission to use, copy, modify, and/or distribute this software for any
 *  purpose with or without fee is hereby granted, provided that the above
 *  copyright notice and this permission notice appear in all copies.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 *  REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 *  AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 *  INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 *  LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 *  OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 *  PERFORMANCE OF THIS SOFTWARE.
 */

import bs58check from 'bs58check'
import RLP from 'rlp'
import { blake2b } from 'blakejs'
import nacl from 'tweetnacl'
import aesjs from 'aes-js'

import { leftPad, rightPad } from './bytes'

const Ecb = aesjs.ModeOfOperation.ecb

export function hash (input) {
  return blake2b(input, null, 32) // 256 bits
}

export function encodeBase58Check (input) {
  return bs58check.encode(input)
}

export function decodeBase58Check (str) {
  return bs58check.decode(str)
}

export function generateKeyPair (raw = false) {
  // <epoch>/apps/aens/test/aens_test_utils.erl
  const keyPair = nacl.sign.keyPair()

  const publicBuffer = Buffer.from(keyPair.publicKey)
  const secretBuffer = Buffer.from(keyPair.secretKey)

  if (raw) {
    return {
      pub: publicBuffer,
      priv: secretBuffer
    }
  } else {
    return {
      pub: `ak$${encodeBase58Check(publicBuffer)}`,
      priv: secretBuffer.toString('hex')
    }
  }
}

export function encryptPublicKey (password, binaryKey) {
  return encryptKey(password, rightPad(32, binaryKey))
}

export function encryptPrivateKey (password, binaryKey) {
  return encryptKey(password, leftPad(64, binaryKey))
}

export function encryptKey (password, binaryData) {
  let hashedPasswordBytes = hash(password)
  let aesEcb = new Ecb(hashedPasswordBytes)
  return aesEcb.encrypt(binaryData)
}

export function decryptKey (password, encrypted) {
  const encryptedBytes = Buffer.from(encrypted)
  let hashedPasswordBytes = hash(password)
  let aesEcb = new Ecb(hashedPasswordBytes)
  return Buffer.from(aesEcb.decrypt(encryptedBytes))
}

export function sign (txBin, privateKey) {
  return nacl.sign.detached(new Uint8Array(txBin), privateKey)
}

export function verify (str, signature, publicKey) {
  return nacl.sign.detached.verify(new Uint8Array(str), signature, publicKey)
}

export function prepareTx (signature, data) {
  // the signed tx deserializer expects a 4-tuple:
  // <tag, version, signatures_array, binary_tx>
  return [Buffer.from([11]), Buffer.from([1]), [Buffer.from(signature)], data]
}

export function personalMessageToBinary (message) {
  const p = Buffer.from('‎Æternity Signed Message:\n', 'utf8')
  const msg = Buffer.from(message, 'utf8')
  if (msg.length >= 0xFD) throw new Error('message too long')
  return Buffer.concat([Buffer.from([p.length]), p, Buffer.from([msg.length]), msg])
}

export function signPersonalMessage (message, privateKey) {
  return sign(personalMessageToBinary(message), privateKey)
}

export function verifyPersonalMessage (str, signature, publicKey) {
  return verify(personalMessageToBinary(str), signature, publicKey)
}

export function getReadablePublicKey (binaryKey) {
  const publicKeyBuffer = Buffer.from(binaryKey, 'hex')
  const pubKeyAddress = encodeBase58Check(publicKeyBuffer)
  return `ak$${pubKeyAddress}`
}

export function generateSaveWallet (password) {
  let keys = generateKeyPair(true)
  return {
    pub: encryptPublicKey(password, keys.pub),
    priv: encryptPrivateKey(password, keys.priv)
  }
}

export function decryptPrivateKey (password, encrypted) {
  return decryptKey(password, encrypted)
}

export function decryptPubKey (password, encrypted) {
  return decryptKey(password, encrypted).slice(0, 65)
}

export function decodeTx (txHash) {
  let decodedTx = decodeBase58Check(txHash.split('$')[1])
  var decoded = RLP.decode(Buffer.from(decodedTx, 'hex'))
  return decoded
}

export function encodeTx (txData) {
  const encodedTxData = RLP.encode(txData)
  const encodedTx = encodeBase58Check(Buffer.from(encodedTxData))
  return `tx$${encodedTx}`
}

export function isValidKeypair (privateKey, publicKey) {
  const message = 'TheMessage'
  const signature = sign(message, privateKey)
  return verify(message, signature, publicKey)
}