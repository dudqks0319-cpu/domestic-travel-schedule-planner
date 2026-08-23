-- ============================================
-- TripMate v3.0 — Supabase Schema
-- Migration from Prisma/SQLite to PostgreSQL
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. users (기존 User 모델)
-- ============================================
create table if not exists users (
  id          text primary key default gen_random_uuid()::text,
  kakao_id    text unique not null,
  nickname    text not null,
  email       text,
  profile_image text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================
-- 2. trips (기존 Trip 모델)
-- ============================================
create table if not exists trips (
  id          text primary key default gen_random_uuid()::text,
  title       text not null,
  destination text not null,
  start_date  timestamptz not null,
  end_date    timestamptz not null,
  transport   text,
  companions  text,
  status      text not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     text not null references users(id) on delete cascade
);

create index if not exists idx_trips_user_id on trips(user_id);

-- ============================================
-- 3. trip_days (기존 TripDay 모델)
-- ============================================
create table if not exists trip_days (
  id          text primary key default gen_random_uuid()::text,
  day_number  int not null,
  date        timestamptz not null,
  trip_id     text not null references trips(id) on delete cascade
);

create index if not exists idx_trip_days_trip_id on trip_days(trip_id);

-- ============================================
-- 4. trip_places (기존 TripPlace 모델)
-- ============================================
create table if not exists trip_places (
  id          text primary key default gen_random_uuid()::text,
  order_index int not null,
  name        text not null,
  address     text,
  lat         double precision,
  lng         double precision,
  category    text not null,
  image_url   text,
  phone       text,
  memo        text,
  start_time  text,
  end_time    text,
  trip_day_id text not null references trip_days(id) on delete cascade
);

create index if not exists idx_trip_places_trip_day_id on trip_places(trip_day_id);

-- ============================================
-- 5. destinations (신규 — 홈 화면 인기 여행지)
-- ============================================
create table if not exists destinations (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  rating      double precision not null default 0,
  image       text not null,
  created_at  timestamptz not null default now()
);

-- Seed data
insert into destinations (id, name, rating, image) values
  ('jeju',  '제주도', 4.8, 'https://images.unsplash.com/photo-1493244040629-496f6d136cc3?w=1200&q=80'),
  ('seoul', '서울',   4.9, 'https://images.unsplash.com/photo-1538485399081-7c897b1ca58b?w=1200&q=80'),
  ('busan', '부산',   4.7, 'https://images.unsplash.com/photo-1617141381731-0f34f44d8d0c?w=1200&q=80')
on conflict (id) do nothing;

-- ============================================
-- 6. reviews (신규 — 목적지 리뷰)
-- ============================================
create table if not exists reviews (
  id             text primary key default gen_random_uuid()::text,
  "user"         text not null,
  tag            text not null,
  score          int not null default 5,
  days_ago       int not null default 0,
  text           text not null,
  helpful        int not null default 0,
  avatar         text not null,
  photo          text,
  type           text not null default '전체',
  destination_id text references destinations(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_reviews_destination_id on reviews(destination_id);

-- Seed data
insert into reviews (id, "user", tag, score, days_ago, text, helpful, avatar, photo, type, destination_id) values
  ('r1', '지현', '가족여행', 5, 2, '일출 정말 좋았어요. 계단이 많아요.', 152,
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
   'https://images.unsplash.com/photo-1573270689103-d7a4e42b6096?w=300&q=80',
   '가족', 'jeju'),
  ('r2', '지현', '가족여행', 5, 2, '주차는 이른 시간 추천. 바람 강해요.', 98,
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
   'https://images.unsplash.com/photo-1573270689103-d7a4e42b6096?w=300&q=80',
   '가족', 'jeju'),
  ('r3', '민수', '혼자여행', 4, 3, '새벽에 가면 사진이 잘 나와요.', 61,
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
   'https://images.unsplash.com/photo-1573270689103-d7a4e42b6096?w=300&q=80',
   '혼자', 'jeju')
on conflict (id) do nothing;

-- ============================================
-- 7. friend_matches (신규 — 여행 친구 매칭)
-- ============================================
create table if not exists friend_matches (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  age         int not null,
  destination text not null,
  date_range  text not null,
  bio         text not null,
  match       int not null default 0,
  avatar      text not null,
  tags        jsonb not null default '[]'::jsonb,
  checklist   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- Seed data
insert into friend_matches (id, name, age, destination, date_range, bio, match, avatar, tags, checklist) values
  ('mate-1', '지은', 27, '제주도', '3월 15-19일', '같이 밥 먹을 사람 찾아요', 92,
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&q=80',
   '["액티비티", "맛집투어"]'::jsonb, '["카페 투어", "사진 촬영", "사정 및 도움"]'::jsonb),
  ('mate-2', '민수', 29, '서울', '4월 5-10일', '문화 탐방 같이 해요', 85,
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&q=80',
   '["도시투어", "쇼핑"]'::jsonb, '["미술관 관람", "도보 여행", "식물원 관람"]'::jsonb),
  ('mate-3', '하윤', 31, '부산', '5월 2-5일', '야경 스팟 같이 다니실 분', 81,
   'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&q=80',
   '["야경", "드라이브"]'::jsonb, '["광안리", "사진 스팟", "저녁 코스"]'::jsonb)
on conflict (id) do nothing;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
alter table users enable row level security;
alter table trips enable row level security;
alter table trip_days enable row level security;
alter table trip_places enable row level security;
alter table destinations enable row level security;
alter table reviews enable row level security;
alter table friend_matches enable row level security;

-- users: only own profile
create policy "Users can view own profile"
  on users for select
  using (auth.uid()::text = id);

create policy "Users can update own profile"
  on users for update
  using (auth.uid()::text = id);

-- trips: owner only
create policy "Users can view own trips"
  on trips for select
  using (auth.uid()::text = user_id);

create policy "Users can create own trips"
  on trips for insert
  with check (auth.uid()::text = user_id);

create policy "Users can update own trips"
  on trips for update
  using (auth.uid()::text = user_id);

create policy "Users can delete own trips"
  on trips for delete
  using (auth.uid()::text = user_id);

-- trip_days: via trip ownership
create policy "Users can manage own trip days"
  on trip_days for all
  using (
    exists (
      select 1 from trips
      where trips.id = trip_days.trip_id
        and trips.user_id = auth.uid()::text
    )
  );

-- trip_places: via day → trip ownership
create policy "Users can manage own trip places"
  on trip_places for all
  using (
    exists (
      select 1 from trip_days
      join trips on trips.id = trip_days.trip_id
      where trip_days.id = trip_places.trip_day_id
        and trips.user_id = auth.uid()::text
    )
  );

-- destinations: public read
create policy "Anyone can view destinations"
  on destinations for select
  using (true);

-- reviews: public read, own write
create policy "Anyone can view reviews"
  on reviews for select
  using (true);

create policy "Authenticated users can create reviews"
  on reviews for insert
  with check (auth.uid() is not null);

-- friend_matches: public read
create policy "Anyone can view friend matches"
  on friend_matches for select
  using (true);

create policy "Authenticated users can create friend matches"
  on friend_matches for insert
  with check (auth.uid() is not null);

-- ============================================
-- updated_at triggers
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_users_updated_at
  before update on users
  for each row execute function update_updated_at();

create trigger set_trips_updated_at
  before update on trips
  for each row execute function update_updated_at();
