use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};
use thiserror::Error;

const PET_SEED: &[u8] = b"pet";
const PET_DATA_LEN: usize = 64;
const SCALE: u16 = 100;
const MAX_STAT: u16 = 100 * SCALE;

#[derive(Error, Debug, Copy, Clone)]
pub enum IriError {
    #[error("Invalid instruction")]
    InvalidInstruction,
    #[error("Invalid account")]
    InvalidAccount,
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Invalid PDA")]
    InvalidPda,
}

impl From<IriError> for ProgramError {
    fn from(e: IriError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy)]
pub enum IriInstruction {
    InitPet,
    Interact { kind: u8 },
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy)]
pub struct PetAccount {
    pub owner: Pubkey,
    pub mood: u16,
    pub health: u16,
    pub gloss: u16,
    pub bump: u8,
    pub last_ts: i64,
}

fn clamp_add(v: u16, delta: i32) -> u16 {
    if delta >= 0 {
        let d = delta as u16;
        let nv = v.saturating_add(d);
        if nv > MAX_STAT { MAX_STAT } else { nv }
    } else {
        let d = (-delta) as u16;
        v.saturating_sub(d)
    }
}

fn apply_decay(pet: &mut PetAccount, now_ts: i64) {
    if now_ts <= pet.last_ts {
        pet.last_ts = now_ts;
        return;
    }
    let dt = (now_ts - pet.last_ts) as u64;
    let mood_loss = (dt.saturating_mul(10)) as i32;
    let health_loss = (dt.saturating_mul(4)) as i32;
    let gloss_loss = (dt.saturating_mul(2)) as i32;
    pet.mood = clamp_add(pet.mood, -mood_loss);
    pet.health = clamp_add(pet.health, -health_loss);
    pet.gloss = clamp_add(pet.gloss, -gloss_loss);
    pet.last_ts = now_ts;
}

fn process_init(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let acc_iter = &mut accounts.iter();
    let owner = next_account_info(acc_iter)?;
    let pet_acc = next_account_info(acc_iter)?;
    let system_program = next_account_info(acc_iter)?;

    if !owner.is_signer {
        return Err(IriError::Unauthorized.into());
    }

    let (expected_pda, bump) = Pubkey::find_program_address(&[PET_SEED, owner.key.as_ref()], program_id);
    if expected_pda != *pet_acc.key {
        return Err(IriError::InvalidPda.into());
    }

    if pet_acc.owner != program_id {
        if *pet_acc.owner != solana_program::system_program::id() {
            return Err(IriError::InvalidAccount.into());
        }
        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(PET_DATA_LEN);
        let create_ix = system_instruction::create_account(owner.key, pet_acc.key, lamports, PET_DATA_LEN as u64, program_id);
        invoke_signed(
            &create_ix,
            &[owner.clone(), pet_acc.clone(), system_program.clone()],
            &[&[PET_SEED, owner.key.as_ref(), &[bump]]],
        )?;
    }

    let clock = Clock::get()?;
    let pet = PetAccount {
        owner: *owner.key,
        mood: 80 * SCALE,
        health: 90 * SCALE,
        gloss: 75 * SCALE,
        bump,
        last_ts: clock.unix_timestamp,
    };

    let mut data = pet_acc.try_borrow_mut_data()?;
    let encoded = pet.try_to_vec().map_err(|_| IriError::InvalidAccount)?;
    if encoded.len() > data.len() {
        return Err(IriError::InvalidAccount.into());
    }
    data[..encoded.len()].copy_from_slice(&encoded);
    for b in data[encoded.len()..].iter_mut() {
        *b = 0;
    }
    Ok(())
}

fn process_interact(program_id: &Pubkey, accounts: &[AccountInfo], kind: u8) -> ProgramResult {
    let acc_iter = &mut accounts.iter();
    let owner = next_account_info(acc_iter)?;
    let pet_acc = next_account_info(acc_iter)?;
    let clock_sysvar = next_account_info(acc_iter)?;

    if !owner.is_signer {
        return Err(IriError::Unauthorized.into());
    }

    let (expected_pda, _bump) = Pubkey::find_program_address(&[PET_SEED, owner.key.as_ref()], program_id);
    if expected_pda != *pet_acc.key {
        return Err(IriError::InvalidPda.into());
    }
    if pet_acc.owner != program_id {
        return Err(IriError::InvalidAccount.into());
    }
    if *clock_sysvar.key != solana_program::sysvar::clock::id() {
        return Err(IriError::InvalidAccount.into());
    }

    let clock = Clock::get()?;
    let mut data = pet_acc.try_borrow_mut_data()?;
    let mut pet = PetAccount::try_from_slice(&data).map_err(|_| IriError::InvalidAccount)?;
    if pet.owner != *owner.key {
        return Err(IriError::Unauthorized.into());
    }

    apply_decay(&mut pet, clock.unix_timestamp);

    match kind {
        0 => {
            pet.health = clamp_add(pet.health, 10 * SCALE as i32);
            pet.mood = clamp_add(pet.mood, 5 * SCALE as i32);
        }
        1 => {
            pet.gloss = clamp_add(pet.gloss, 15 * SCALE as i32);
            pet.mood = clamp_add(pet.mood, 10 * SCALE as i32);
        }
        2 => {
            pet.mood = clamp_add(pet.mood, 20 * SCALE as i32);
            pet.health = clamp_add(pet.health, -(5 * SCALE as i32));
        }
        _ => return Err(IriError::InvalidInstruction.into()),
    }

    let encoded = pet.try_to_vec().map_err(|_| IriError::InvalidAccount)?;
    if encoded.len() > data.len() {
        return Err(IriError::InvalidAccount.into());
    }
    data[..encoded.len()].copy_from_slice(&encoded);
    Ok(())
}

pub fn process_instruction(program_id: &Pubkey, accounts: &[AccountInfo], input: &[u8]) -> ProgramResult {
    let ix = IriInstruction::try_from_slice(input).map_err(|_| IriError::InvalidInstruction)?;
    match ix {
        IriInstruction::InitPet => process_init(program_id, accounts),
        IriInstruction::Interact { kind } => process_interact(program_id, accounts, kind),
    }
}

entrypoint!(entry);
fn entry(program_id: &Pubkey, accounts: &[AccountInfo], input: &[u8]) -> ProgramResult {
    if input.is_empty() {
        msg!("Empty instruction data");
        return Err(IriError::InvalidInstruction.into());
    }
    process_instruction(program_id, accounts, input)
}

