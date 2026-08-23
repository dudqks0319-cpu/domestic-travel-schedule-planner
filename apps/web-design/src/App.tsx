import { Bell, Search, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const destinations = [
  {
    name: "제주도",
    rating: "4.8",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80",
  },
  {
    name: "서울",
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1598495897814-0d1b6f4c9f35?w=1200&q=80",
  },
  {
    name: "부산",
    rating: "4.7",
    image:
      "https://images.unsplash.com/photo-1534270804882-6b5048b1c1fc?w=1200&q=80",
  },
];

const quickTags = [
  { label: "가족여행", color: "bg-[#f4d7cf]" },
  { label: "혼자여행", color: "bg-[#dce9f8]" },
  { label: "커플여행", color: "bg-[#e5dcf4]" },
  { label: "액티비티", color: "bg-[#d9efdf]" },
];

const matchCards = [
  {
    name: "지은, 27세",
    score: "92% 매칭",
    meta: "제주도 | 3월 15-19일",
    tags: ["액티비티", "맛집투어"],
    bio: "같이 밥 먹을 사람 찾아요",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
  },
  {
    name: "민수, 29세",
    score: "85% 매칭",
    meta: "서울 | 4월 5-10일",
    tags: ["도시투어", "쇼핑"],
    bio: "문화 탐방 같이 해요",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
  },
];

function App() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text-primary)]">
      <div className="mx-auto w-full max-w-[430px]">
        <header className="mb-5">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">트립메이트</h1>
              <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
                안녕하세요, 김지수님! 오늘 어디로 여행 가시겠어요?
              </p>
            </div>
            <Button variant="outline" size="icon-sm" className="rounded-full">
              <Bell className="size-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 rounded-xl pl-9" placeholder="지역, 관광지, 맛집 검색" />
          </div>
        </header>

        <section className="space-y-3">
          {destinations.map((destination) => (
            <Card
              key={destination.name}
              className="overflow-hidden rounded-2xl border-none p-0 shadow-md"
            >
              <div className="relative h-30 w-full">
                <img
                  alt={destination.name}
                  className="h-full w-full object-cover"
                  src={destination.image}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <div className="absolute right-3 bottom-2 left-3 flex items-end justify-between text-white">
                  <h2 className="text-3xl font-extrabold tracking-tight">
                    {destination.name}
                  </h2>
                  <p className="inline-flex items-center gap-1 text-lg font-bold">
                    <Star className="size-4 fill-white text-white" /> {destination.rating}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </section>

        <section className="mt-4 grid grid-cols-4 gap-2">
          {quickTags.map((tag) => (
            <button
              key={tag.label}
              className={`cursor-pointer rounded-xl border border-black/5 px-2 py-4 text-center text-xs font-bold text-zinc-700 transition hover:-translate-y-0.5 ${tag.color}`}
              type="button"
            >
              {tag.label}
            </button>
          ))}
        </section>

        <Card className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
          <CardHeader className="px-4 pb-3">
            <CardTitle className="text-lg font-extrabold tracking-tight">
              여행 친구 찾기
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="mb-4 flex items-center gap-2">
              <Avatar className="size-9 border-2 border-white shadow-sm">
                <AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80" />
                <AvatarFallback>MJ</AvatarFallback>
              </Avatar>
              <Avatar className="size-9 border-2 border-white shadow-sm">
                <AvatarImage src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&q=80" />
                <AvatarFallback>SH</AvatarFallback>
              </Avatar>
              <Avatar className="size-9 border-2 border-white shadow-sm">
                <AvatarImage src="https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=120&q=80" />
                <AvatarFallback>JW</AvatarFallback>
              </Avatar>
              <p className="ml-1 text-sm font-bold text-zinc-700">Minji · Suho · Jiwoo</p>
            </div>

            <Tabs defaultValue="all">
              <TabsList className="mb-3 h-9 w-full rounded-xl bg-zinc-100 p-1">
                <TabsTrigger className="rounded-lg text-xs font-bold" value="all">
                  전체
                </TabsTrigger>
                <TabsTrigger className="rounded-lg text-xs font-bold" value="schedule">
                  같은 일정
                </TabsTrigger>
                <TabsTrigger className="rounded-lg text-xs font-bold" value="rank">
                  높은 매칭순
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-3">
              {matchCards.map((card) => (
                <article
                  key={card.name}
                  className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <Avatar className="size-14">
                      <AvatarImage src={card.avatar} />
                      <AvatarFallback>{card.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold">{card.name}</h3>
                        <Badge className="ml-auto rounded-full bg-emerald-100 text-emerald-700">
                          {card.score}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-zinc-600">{card.meta}</p>
                      <div className="mt-1.5 flex gap-1.5">
                        {card.tags.map((tag) => (
                          <Badge
                            key={tag}
                            className="rounded-full bg-zinc-100 text-[11px] text-zinc-700"
                            variant="secondary"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="mb-2 text-sm font-medium text-zinc-600">{card.bio}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="rounded-full bg-[var(--color-accent-coral)] text-white hover:bg-[var(--color-accent-coral)]/90">
                      채팅하기
                    </Button>
                    <Button className="rounded-full" variant="secondary">
                      일정 비교
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default App;
