# 🏋️‍♂️ Decentralized Trainer Review Platform

Welcome to a fair and transparent way to review fitness trainers using the Stacks blockchain! This decentralized platform ensures that trainer reviews are immutable, verifiable, and free from manipulation, fostering trust between clients and trainers.

## ✨ Features

🔍 **Immutable Reviews**: Users can submit reviews for trainers, stored on-chain for transparency.  
🏆 **Reputation System**: Trainers earn reputation scores based on verified reviews.  
💰 **Token Incentives**: Users earn tokens for submitting honest reviews, discouraging spam.  
⚖️ **Dispute Resolution**: Moderators can resolve disputes over unfair reviews.  
🔐 **Profile Management**: Trainers can create and update profiles with verified credentials.  
✅ **Verification**: Anyone can verify the authenticity of reviews and trainer profiles.  
🚫 **Spam Prevention**: Mechanisms to prevent fake or duplicate reviews.  
📊 **Analytics**: Aggregate trainer ratings and review statistics for transparency.

## 🛠 How It Works

**For Users (Clients)**  
- Submit a review for a trainer with a rating (1-5 stars), comment, and optional proof of engagement (e.g., booking hash).  
- Earn tokens for submitting reviews, subject to validation.  
- Verify trainer reputation or review authenticity using public functions.  

**For Trainers**  
- Create and manage a profile with details like certifications, experience, and contact info.  
- Respond to reviews or flag disputes for moderator review.  
- Build a reputation score based on verified reviews.  

**For Moderators**  
- Review flagged disputes and vote on resolution (e.g., remove unfair reviews).  
- Earn tokens for fair moderation.  

**For Verifiers**  
- Query trainer profiles, reviews, or reputation scores to confirm authenticity.  
- Access dispute resolution outcomes for transparency.  

## 📂 Smart Contracts (8 Total)

Below are the eight Clarity smart contracts that power the platform:

1. **trainer-profile.clar**  
   Manages trainer profiles, allowing creation, updates, and verification of trainer details.  
   - Functions: `create-profile`, `update-profile`, `get-profile`.  

2. **review-submission.clar**  
   Handles review submissions, including rating, comment, and proof of engagement.  
   - Functions: `submit-review`, `get-review`, `list-reviews-by-trainer`.  

3. **reputation-system.clar**  
   Calculates and updates trainer reputation scores based on verified reviews.  
   - Functions: `calculate-reputation`, `get-reputation`, `update-reputation`.  

4. **token-reward.clar**  
   Manages token rewards for users and moderators, ensuring fair distribution.  
   - Functions: `issue-tokens`, `check-balance`, `transfer-tokens`.  

5. **dispute-resolution.clar**  
   Allows trainers to flag unfair reviews and moderators to resolve disputes.  
   - Functions: `flag-review`, `resolve-dispute`, `get-dispute-status`.  

6. **spam-prevention.clar**  
   Prevents duplicate or fake reviews using engagement proof and rate limits.  
   - Functions: `validate-review`, `check-duplicate`, `enforce-rate-limit`.  

7. **moderator-voting.clar**  
   Enables moderators to vote on dispute resolutions to ensure fairness.  
   - Functions: `submit-vote`, `tally-votes`, `get-voting-results`.  

8. **analytics.clar**  
   Provides aggregate data like average ratings, review counts, and trainer rankings.  
   - Functions: `get-average-rating`, `get-trainer-stats`, `list-top-trainers`.  

## 🚀 Getting Started

1. **Set Up Stacks Wallet**: Install a Stacks-compatible wallet (e.g., Hiro Wallet) to interact with the platform.  
2. **Deploy Contracts**: Use the Clarity CLI to deploy the contracts on the Stacks testnet.  
3. **Register as a Trainer or User**:  
   - Trainers: Call `create-profile` in `trainer-profile.clar` to set up your profile.  
   - Users: Submit reviews using `submit-review` in `review-submission.clar`.  
4. **Earn Rewards**: Submit valid reviews or participate in moderation to earn tokens.  
5. **Verify Data**: Use public read-only functions to verify reviews, profiles, or reputation scores.  

## 🧑‍💻 Example Usage

**Submit a Review**  
- Generate a booking hash (e.g., SHA-256 of a booking confirmation).  
- Call `submit-review` with:  
  - Trainer's principal (address).  
  - Rating (1-5).  
  - Comment (text).  
  - Booking hash (proof of engagement).  

**Verify a Review**  
- Call `get-review` with the review ID to check details.  
- Use `verify-ownership` in `review-submission.clar` to confirm the reviewer's identity.  

**Resolve a Dispute**  
- Trainer flags a review using `flag-review` in `dispute-resolution.clar`.  
- Moderators vote via `submit-vote` in `moderator-voting.clar`.  
- Check outcome with `get-dispute-status`.  

## 🔒 Security & Fairness

- **Immutability**: Reviews and profiles are stored on the Stacks blockchain, ensuring tamper-proof records.  
- **Spam Prevention**: Engagement proofs and rate limits prevent fake reviews.  
- **Decentralized Moderation**: Multiple moderators vote on disputes to avoid bias.  
- **Transparency**: All data (reviews, reputations, disputes) is publicly queryable.  

## 🛠 Tech Stack

- **Blockchain**: Stacks (Bitcoin Layer-2).  
- **Smart Contract Language**: Clarity.  
- **Token Standard**: SIP-010 (fungible token standard for rewards).  
- **Frontend (Optional)**: React with Stacks.js for a user-friendly interface.  

## 🌟 Why This Matters

This platform solves real-world problems in the fitness industry:  
- **Trust**: Eliminates fake or biased reviews with blockchain immutability.  
- **Fairness**: Decentralized moderation prevents unfair treatment of trainers.  
- **Incentives**: Rewards honest participation, encouraging high-quality reviews.  
- **Transparency**: Publicly verifiable data builds trust for clients and trainers alike.  

Get started today and bring fairness to fitness trainer reviews! 🏋️‍♂️
