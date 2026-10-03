import {Skeleton,SkeletonItem} from '@fluentui/react-components';

export default function DashboardLoading(){
  return <div className="mx-auto w-[calc(100%-24px)] max-w-[1600px] space-y-4 py-5 sm:w-[calc(100%-48px)]" aria-label="Loading Dashboard">
    <Skeleton aria-label="Loading dashboard heading"><SkeletonItem size={32} style={{width:280}}/></Skeleton>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{Array.from({length:6},(_,index)=><Skeleton key={index} aria-label="Loading status"><SkeletonItem style={{height:80}}/></Skeleton>)}</div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_5fr]">{Array.from({length:2},(_,index)=><Skeleton key={index} aria-label="Loading operations"><SkeletonItem style={{height:240}}/></Skeleton>)}</div>
    <Skeleton aria-label="Loading projects"><SkeletonItem style={{height:260}}/></Skeleton>
  </div>;
}
