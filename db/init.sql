-- Schema for local Sage-like app
create table if not exists products (
  id varchar primary key,
  sku varchar not null,
  name varchar not null,
  unit varchar not null default 'u',
  price numeric not null default 0
);

create table if not exists depots (
  id varchar primary key,
  name varchar not null
);

create table if not exists stock (
  product_id varchar references products(id),
  depot_id varchar references depots(id),
  qty numeric not null default 0,
  primary key (product_id, depot_id)
);

create table if not exists clients (
  id varchar primary key,
  name varchar not null,
  type varchar not null check (type in ('comptoir','web'))
);

create table if not exists documents (
  id varchar primary key,
  code varchar not null unique,
  type varchar not null check (type in ('DV','BC','BL','BR','FA')),
  mode varchar not null check (mode in ('vente','achat')),
  date date not null,
  status varchar not null,
  depot_id varchar references depots(id),
  client_id varchar references clients(id),
  vendor_name varchar,
  notes text,
  ref_from_id varchar references documents(id)
);

create table if not exists document_lines (
  id varchar primary key,
  document_id varchar references documents(id),
  product_id varchar references products(id),
  description varchar not null,
  qty numeric not null,
  unit_price numeric not null,
  remise_amount numeric not null default 0
);

-- Seed demo data (doors company)
insert into products (id, sku, name, unit, price) values
  ('p1','DR-001','Porte Bois Chêne','u',1500),
  ('p2','FR-002','Cadre Métal 90cm','u',450),
  ('p3','AC-003','Poignée Inox','u',120)
  on conflict (id) do nothing;

insert into depots (id, name) values
  ('d1','Dépôt Central'),
  ('d2','Showroom')
  on conflict (id) do nothing;

insert into stock (product_id, depot_id, qty) values
  ('p1','d1',20),('p2','d1',50),('p3','d1',200),('p1','d2',5)
  on conflict (product_id, depot_id) do nothing;

insert into clients (id, name, type) values
  ('c1','Client Comptoir','comptoir'),
  ('c2','Client Web','web')
  on conflict (id) do nothing;
